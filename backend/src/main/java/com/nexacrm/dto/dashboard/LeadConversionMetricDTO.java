package com.nexacrm.dto.dashboard;

public record LeadConversionMetricDTO(
    double value,
    double previousValue,
    double changePercent
) {}
