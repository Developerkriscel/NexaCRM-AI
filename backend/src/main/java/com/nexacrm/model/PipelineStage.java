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

@Document(collection = "pipeline_stages")
@CompoundIndexes({
    @CompoundIndex(name = "pipeline_stage_tenant_pipeline_key_idx", def = "{'tenant_id': 1, 'pipeline_id': 1, 'key': 1}", unique = true),
    @CompoundIndex(name = "pipeline_stage_tenant_pipeline_position_idx", def = "{'tenant_id': 1, 'pipeline_id': 1, 'position': 1}")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PipelineStage extends BaseEntity {

    @Field("pipeline_id")
    private Long pipelineId;

    @Field("key")
    private String key;

    @Field("name")
    private String name;

    @Field("position")
    private Integer position;

    @Field("color")
    private String color;

    @Field("is_closed_won")
    private Boolean isClosedWon = false;

    @Field("is_closed_lost")
    private Boolean isClosedLost = false;
}
