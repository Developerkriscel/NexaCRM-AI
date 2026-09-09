package com.nexacrm.controller;

import com.nexacrm.dto.dashboard.DashboardOverviewDTO;
import com.nexacrm.dto.dashboard.DashboardWidgetSnapshotDTO;
import com.nexacrm.service.dashboard.DashboardAnalyticsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
@Tag(name = "Analytics", description = "Aggregated dashboard analytics")
public class AnalyticsController {

    private final DashboardAnalyticsService dashboardAnalyticsService;

    @GetMapping("/dashboard")
    @PreAuthorize("hasAuthority('reports.read')")
    @Operation(summary = "Aggregated dashboard overview")
    public ResponseEntity<DashboardOverviewDTO> getDashboard() {
        return ResponseEntity.ok(dashboardAnalyticsService.overview());
    }

    @GetMapping("/dashboard/widgets")
    @PreAuthorize("hasAuthority('reports.read')")
    @Operation(summary = "Operational dashboard widget data")
    public ResponseEntity<DashboardWidgetSnapshotDTO> getDashboardWidgets() {
        return ResponseEntity.ok(dashboardAnalyticsService.widgets());
    }

    @GetMapping("/revenue")
    @PreAuthorize("hasAuthority('reports.read')")
    @Operation(summary = "Revenue trend by month")
    public ResponseEntity<Map<String, Object>> getRevenue() {
        DashboardWidgetSnapshotDTO widgets = dashboardAnalyticsService.widgets();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("series", widgets.monthlyRevenue());
        response.put("generatedAt", widgets.generatedAt());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/conversion")
    @PreAuthorize("hasAuthority('reports.read')")
    @Operation(summary = "Lead conversion summary")
    public ResponseEntity<Map<String, Object>> getConversion() {
        DashboardWidgetSnapshotDTO widgets = dashboardAnalyticsService.widgets();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("funnel", widgets.funnelData());
        response.put("agingCounts", widgets.agingCounts());
        response.put("slaSummary", widgets.slaSummary());
        response.put("generatedAt", widgets.generatedAt());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/team")
    @PreAuthorize("hasAuthority('reports.read')")
    @Operation(summary = "Team performance analytics")
    public ResponseEntity<Map<String, Object>> getTeam() {
        DashboardWidgetSnapshotDTO widgets = dashboardAnalyticsService.widgets();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("series", widgets.employeePerformance());
        response.put("generatedAt", widgets.generatedAt());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/campaigns")
    @PreAuthorize("hasAuthority('reports.read')")
    @Operation(summary = "Lead source and campaign performance")
    public ResponseEntity<Map<String, Object>> getCampaigns() {
        DashboardWidgetSnapshotDTO widgets = dashboardAnalyticsService.widgets();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("series", widgets.leadSources());
        response.put("generatedAt", widgets.generatedAt());
        return ResponseEntity.ok(response);
    }

    @GetMapping(value = "/export", produces = "text/csv")
    @PreAuthorize("hasAuthority('reports.export')")
    @Operation(summary = "Export live analytics data as CSV")
    public ResponseEntity<byte[]> exportReport() {
        DashboardOverviewDTO overview = dashboardAnalyticsService.overview();
        DashboardWidgetSnapshotDTO widgets = dashboardAnalyticsService.widgets();

        StringBuilder csv = new StringBuilder();
        csv.append("section,metric,value\n");

        appendMetric(csv, "overview", "leads", overview.leads() != null ? overview.leads().size() : 0);
        appendMetric(csv, "overview", "deals", overview.deals() != null ? overview.deals().size() : 0);
        appendMetric(csv, "overview", "insights", overview.insights() != null ? overview.insights().size() : 0);
        appendMetric(csv, "overview", "recentActivity", overview.recentActivity() != null ? overview.recentActivity().size() : 0);
        appendMetric(csv, "overview", "recentCallSnapshots", overview.recentCallSnapshots() != null ? overview.recentCallSnapshots().size() : 0);

        appendMetric(csv, "widgets", "freshLeads", widgets.agingCounts() != null ? widgets.agingCounts().fresh() : 0);
        appendMetric(csv, "widgets", "warningLeads", widgets.agingCounts() != null ? widgets.agingCounts().warning() : 0);
        appendMetric(csv, "widgets", "criticalLeads", widgets.agingCounts() != null ? widgets.agingCounts().critical() : 0);
        appendMetric(csv, "widgets", "slaTotal", widgets.slaSummary() != null ? widgets.slaSummary().total() : 0);
        appendMetric(csv, "widgets", "slaAvgResponseMinutes", widgets.slaSummary() != null && widgets.slaSummary().avgResponseMinutes() != null ? widgets.slaSummary().avgResponseMinutes() : "");

        appendRows(csv, "lead_source", widgets.leadSources() != null ? widgets.leadSources().stream().map(source -> List.of(
            safeCsv("lead_sources"),
            safeCsv(source.name()),
            safeCsv(source.value())
        )).toList() : List.<List<String>>of());
        appendRows(csv, "funnel", widgets.funnelData() != null ? widgets.funnelData().stream().map(stage -> List.of(
            safeCsv("funnel"),
            safeCsv(stage.stage()),
            safeCsv(stage.count())
        )).toList() : List.<List<String>>of());
        appendRows(csv, "revenue", widgets.monthlyRevenue() != null ? widgets.monthlyRevenue().stream().map(bucket -> List.of(
            safeCsv("revenue"),
            safeCsv(bucket.month()),
            safeCsv(bucket.revenue())
        )).toList() : List.<List<String>>of());
        appendRows(csv, "team", widgets.employeePerformance() != null ? widgets.employeePerformance().stream().map(person -> List.of(
            safeCsv("team"),
            safeCsv(person.owner()),
            safeCsv(person.total())
        )).toList() : List.<List<String>>of());

        byte[] body = csv.toString().getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
            .header("Content-Disposition", "attachment; filename=nexacrm-analytics.csv")
            .body(body);
    }

    private void appendMetric(StringBuilder csv, String section, String metric, Object value) {
        csv.append(safeCsv(section)).append(',')
            .append(safeCsv(metric)).append(',')
            .append(safeCsv(value))
            .append('\n');
    }

    private void appendRows(StringBuilder csv, String section, List<List<String>> rows) {
        for (List<String> row : rows) {
            csv.append(String.join(",", row)).append('\n');
        }
    }

    private String safeCsv(Object value) {
        if (value == null) {
            return "\"\"";
        }
        String text = String.valueOf(value).replace("\"", "\"\"");
        return "\"" + text + "\"";
    }
}
