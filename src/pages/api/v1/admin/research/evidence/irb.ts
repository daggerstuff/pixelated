import { protectRoute } from "../../../../../../lib/auth/serverAuth";
import {
  getEvidenceReportGenerator,
  type TemplateId,
} from "../../../../../../lib/research/services/EvidenceReportTemplates";
import { getIRBExportService } from "../../../../../../lib/research/services/IRBExportService";

export const prerender = false;

export const POST = protectRoute({
  requiredRole: "admin",
  validateIPMatch: true,
  validateUserAgent: true,
})(async ({ request }) => {
  try {
    const body = await request.json();
    const { templateId, customFilters, format } = body as {
      templateId: TemplateId;
      customFilters?: Record<string, unknown>;
      format?: "json" | "markdown";
    };

    if (!templateId) {
      return new Response(JSON.stringify({ error: "templateId is required" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    }

    const generator = getEvidenceReportGenerator();
    const generated = await generator.generateFromTemplate(templateId, customFilters);

    const irbService = getIRBExportService();
    const pkg = irbService.generatePackage(generated);

    if (format === "markdown") {
      const markdown = irbService.exportAsMarkdown(pkg);
      return new Response(markdown, {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Content-Disposition": `attachment; filename="irb-export-${templateId}-${Date.now()}.md"`,
          "X-Package-Id": pkg.packageId,
          Pragma: "no-cache",
        },
      });
    }

    const json = irbService.exportAsJson(pkg);
    return new Response(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Content-Disposition": `attachment; filename="irb-export-${templateId}-${Date.now()}.json"`,
        "X-Package-Id": pkg.packageId,
        Pragma: "no-cache",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  }
});

export const GET = protectRoute({
  requiredRole: "admin",
  validateIPMatch: true,
  validateUserAgent: true,
})(async () => {
  return new Response(
    JSON.stringify({
      endpoint: "IRB Export Package Generator",
      description:
        "Generates a complete IRB export package containing methodology, anonymized dataset, audit log, and HIPAA compliance summary.",
      method: "POST",
      requiredFields: ["templateId"],
      optionalFields: ["customFilters", "format (json|markdown)"],
      templates: getEvidenceReportGenerator()
        .getTemplates()
        .map((t) => ({
          id: t.id,
          name: t.name,
        })),
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    },
  );
});
