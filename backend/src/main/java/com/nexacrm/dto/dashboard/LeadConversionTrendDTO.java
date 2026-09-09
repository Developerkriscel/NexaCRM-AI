package com.nexacrm.dto.dashboard;

import java.time.LocalDateTime;

public record LeadConversionTrendDTO(
    String bucketKey,
    String label,
    LocalDateTime bucketStart,
    long leadCount,
    long contactedCount,
    long qualifiedCount,
    long convertedCount,
    long lostCount,
    double revenueGenerated
) {}
