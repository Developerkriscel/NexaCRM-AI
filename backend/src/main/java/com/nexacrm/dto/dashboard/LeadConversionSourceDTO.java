package com.nexacrm.dto.dashboard;

public record LeadConversionSourceDTO(
    String sourceKey,
    String sourceLabel,
    long totalLeads,
    long convertedLeads,
    long lostLeads,
    double conversionRate,
    double revenueGenerated,
    boolean bestPerforming
) {}
