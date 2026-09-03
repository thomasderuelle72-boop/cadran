import { Controller, Get, Param, Res, UseGuards } from "@nestjs/common";
import { Response } from "express";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../common/current-user.decorator";
import { ReportsService } from "./reports.service";

@Controller("periods")
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get(":id/report.pdf")
  async downloadReport(@CurrentUser() user: AuthUser, @Param("id") id: string, @Res() res: Response) {
    const pdf = await this.reportsService.generatePeriodReport(user.organizationId, id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="cadran-rapport-${id}.pdf"`);
    res.send(pdf);
  }

  @Get(":id/report.xlsx")
  async downloadReportExcel(@CurrentUser() user: AuthUser, @Param("id") id: string, @Res() res: Response) {
    const excel = await this.reportsService.generatePeriodReportExcel(user.organizationId, id);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="cadran-rapport-${id}.xlsx"`);
    res.send(excel);
  }
}
