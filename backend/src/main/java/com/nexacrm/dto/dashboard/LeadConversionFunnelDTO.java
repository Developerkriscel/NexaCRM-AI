package com.nexacrm.dto.dashboard;

public record LeadConversionFunnelDTO(
    String key,
    String label,
    long count,
    double dropOffPercent,
    double conversionPercent
) {}
