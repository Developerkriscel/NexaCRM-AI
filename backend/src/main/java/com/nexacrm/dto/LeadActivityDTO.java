package com.nexacrm.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LeadActivityDTO {
    private String id;
    private String leadId;

    @NotNull(message = "Activity index is required")
    @Min(value = 0, message = "Activity index must be between 0 and 3")
    @Max(value = 3, message = "Activity index must be between 0 and 3")
    private Integer activityIndex;

    private String activityId;
    private String activityLabel;
    private String activityTitle;
    @NotBlank(message = "Assigned To is required")
    private String assignedTo;
    private String summary;
    private Map<String, Object> values;
    private LocalDateTime savedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
