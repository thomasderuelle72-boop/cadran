import { useEntities } from "../api/hooks";

export const CONSOLIDATED_VALUE = "__consolidated__";

export function EntitySelector({
  value,
  onChange,
  allowConsolidated,
}: {
  value: string;
  onChange: (value: string) => void;
  allowConsolidated?: boolean;
}) {
  const { data: entities } = useEntities();

  return (
    <select className="input w-56" value={value} onChange={(e) => onChange(e.target.value)}>
      {allowConsolidated && <option value={CONSOLIDATED_VALUE}>Consolidé (groupe)</option>}
      {entities?.map((entity) => (
        <option key={entity.id} value={entity.id}>
          {entity.name}
        </option>
      ))}
    </select>
  );
}
