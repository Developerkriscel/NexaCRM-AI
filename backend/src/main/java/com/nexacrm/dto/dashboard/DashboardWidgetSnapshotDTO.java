package com.nexacrm.dto.dashboard;

import java.util.List;

public record DashboardWidgetSnapshotDTO(
    AgingCounts agingCounts,
    LeadSlaSummary slaSummary,
    List<EmployeePerformance> employeePerformance,
    List<RevenueBucket> monthlyRevenue,
    List<FunnelStage> funnelData,
    List<LeadSourceShare> leadSources,
    String generatedAt
) {
    public record AgingCounts(long fresh, long warning, long critical) {}

    public record LeadSlaSummary(
        long total,
        long unattendedCritical,
        long pending,
        long met,
        long breached,
        Double avgResponseMinutes
    ) {}

    public record EmployeePerformance(
        String owner,
        long total,
        long unattended,
        long met,
        long breached,
        long pending
    ) {}

    public record RevenueBucket(
        String month,
        double revenue,
        long deals
    ) {}

    public record FunnelStage(
        String stage,
        long count,
        String color
    ) {}

    public record LeadSourceShare(
        String name,
        double value,
        String color
    ) {}
}
