import {
  COTE_MAX,
  COTE_MIN,
  POIDS_MAX,
  ajuster,
  validerImage,
} from "./image";

/** Fabrique un PNG minimal dont seul l'en-tête compte pour la validation. */
function png(largeur: number, hauteur: number): Buffer {
  const octets = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(octets, 0);
  octets.writeUInt32BE(13, 8);
  octets.write("IHDR", 12, "ascii");
  octets.writeUInt32BE(largeur, 16);
  octets.writeUInt32BE(hauteur, 20);
  return octets;
}

/** JPEG minimal : un segment APP0 puis un SOF0 porteur des dimensions. */
function jpeg(largeur: number, hauteur: number, segmentsAvant = 1): Buffer {
  const morceaux: Buffer[] = [Buffer.from([0xff, 0xd8])];
  for (let i = 0; i < segmentsAvant; i += 1) {
    const app = Buffer.alloc(20);
    app.writeUInt8(0xff, 0);
    app.writeUInt8(0xe0, 1);
    app.writeUInt16BE(18, 2);
    morceaux.push(app);
  }
  const sof = Buffer.alloc(11);
  sof.writeUInt8(0xff, 0);
  sof.writeUInt8(0xc0, 1);
  sof.writeUInt16BE(9, 2);
  sof.writeUInt8(8, 4);
  sof.writeUInt16BE(hauteur, 5);
  sof.writeUInt16BE(largeur, 7);
  morceaux.push(sof);
  return Buffer.concat(morceaux);
}

describe("validation d'une image de marque", () => {
  it("accepte un PNG et lit ses dimensions", () => {
    const verdict = validerImage(png(320, 120));
    expect(verdict).toEqual({
      valide: true,
      image: { format: "image/png", largeur: 320, hauteur: 120 },
    });
  });

  it("accepte un JPEG et lit ses dimensions", () => {
    const verdict = validerImage(jpeg(800, 600));
    expect(verdict).toEqual({
      valide: true,
      image: { format: "image/jpeg", largeur: 800, hauteur: 600 },
    });
  });

  it("trouve le marqueur JPEG même précédé de plusieurs segments", () => {
    // La position du SOF varie selon ce que l'appareil photo ou le logiciel
    // a inséré avant : il faut parcourir, pas lire à position fixe.
    const verdict = validerImage(jpeg(400, 300, 6));
    expect(verdict).toEqual({
      valide: true,
      image: { format: "image/jpeg", largeur: 400, hauteur: 300 },
    });
  });

  it("refuse un fichier vide", () => {
    expect(validerImage(Buffer.alloc(0))).toEqual({ valide: false, motif: "vide" });
  });

  it("refuse un fichier qui n'est pas une image, quel que soit son nom", () => {
    // Le type déclaré et l'extension viennent de l'appelant : seuls les
    // octets de tête font foi.
    expect(validerImage(Buffer.from("<?php system($_GET['c']); ?>"))).toEqual({
      valide: false,
      motif: "format-inconnu",
    });
    expect(validerImage(Buffer.from("GIF89a"))).toEqual({
      valide: false,
      motif: "format-inconnu",
    });
  });

  it("refuse un SVG, qui est un document XML et non une image", () => {
    // Il peut porter du script et référencer des entités externes ; aucun
    // générateur de PDF ne l'embarque tel quel.
    expect(validerImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toEqual({
      valide: false,
      motif: "format-inconnu",
    });
  });

  it("refuse au-delà du poids admis", () => {
    const enorme = Buffer.alloc(POIDS_MAX + 1);
    png(10, 10).copy(enorme, 0);
    expect(validerImage(enorme)).toEqual({ valide: false, motif: "trop-lourde" });
  });

  it("refuse une image dont les dimensions sont démesurées", () => {
    // Le poids seul ne protège pas : un PNG de quelques dizaines de ko peut
    // se décompresser en dizaines de milliers de pixels de côté.
    expect(validerImage(png(COTE_MAX + 1, 100))).toEqual({ valide: false, motif: "trop-grande" });
    expect(validerImage(png(100, COTE_MAX + 1))).toEqual({ valide: false, motif: "trop-grande" });
  });

  it("refuse une image trop petite pour être lisible", () => {
    expect(validerImage(png(COTE_MIN - 1, 40))).toEqual({ valide: false, motif: "trop-petite" });
  });

  it("refuse un PNG dont l'en-tête est tronqué", () => {
    const tronque = png(100, 100).subarray(0, 18);
    expect(validerImage(tronque)).toEqual({ valide: false, motif: "illisible" });
  });

  it("refuse un PNG dont le premier bloc n'est pas IHDR", () => {
    const truque = png(100, 100);
    truque.write("IDAT", 12, "ascii");
    expect(validerImage(truque)).toEqual({ valide: false, motif: "illisible" });
  });

  it("ne boucle pas sur un JPEG dont un segment déclare une longueur absurde", () => {
    // Un segment de longueur 0 ferait avancer de 2 octets indéfiniment.
    const piege = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(validerImage(piege)).toEqual({ valide: false, motif: "illisible" });
  });

  it("refuse un JPEG sans marqueur de dimensions", () => {
    const app = Buffer.alloc(32);
    app.writeUInt8(0xff, 0);
    app.writeUInt8(0xe0, 1);
    app.writeUInt16BE(30, 2);
    const sansSof = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), app.subarray(1)]);
    expect(validerImage(sansSof)).toEqual({ valide: false, motif: "illisible" });
  });
});

describe("ajustement dans une boîte", () => {
  it("conserve les proportions d'une image large", () => {
    // Imposer largeur et hauteur à la fois aplatirait le logo.
    expect(ajuster({ largeur: 400, hauteur: 100 }, { largeur: 160, hauteur: 60 })).toEqual({
      largeur: 160,
      hauteur: 40,
    });
  });

  it("conserve les proportions d'une image haute", () => {
    expect(ajuster({ largeur: 100, hauteur: 400 }, { largeur: 160, hauteur: 60 })).toEqual({
      largeur: 15,
      hauteur: 60,
    });
  });

  it("n'agrandit jamais au-delà de la taille d'origine", () => {
    // Un logo de 60 pixels étiré à 200 est flou, et le flou se remarque
    // davantage que la petite taille.
    expect(ajuster({ largeur: 60, hauteur: 20 }, { largeur: 160, hauteur: 60 })).toEqual({
      largeur: 60,
      hauteur: 20,
    });
  });

  it("laisse intacte une image qui tient exactement", () => {
    expect(ajuster({ largeur: 160, hauteur: 60 }, { largeur: 160, hauteur: 60 })).toEqual({
      largeur: 160,
      hauteur: 60,
    });
  });
});
