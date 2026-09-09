package com.nexacrm.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.LocalDateTime;
import java.util.Map;

@Document(collection = "report_snapshots")
@CompoundIndexes({
    @CompoundIndex(name = "report_tenant_type_created_idx", def = "{'tenant_id': 1, 'report_type': 1, 'createdAt': -1}")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReportSnapshot extends BaseEntity {

    @Field("report_type")
    private String reportType;

    @Field("period_start")
    private LocalDateTime periodStart;

    @Field("period_end")
    private LocalDateTime periodEnd;

    @Field("payload")
    private Map<String, Object> payload;

    @Field("generated_by_id")
    private String generatedById;

    @Field("generated_at")
    private LocalDateTime generatedAt;
}
