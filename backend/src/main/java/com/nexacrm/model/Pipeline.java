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

@Document(collection = "pipelines")
@CompoundIndexes({
    @CompoundIndex(name = "pipeline_tenant_name_idx", def = "{'tenant_id': 1, 'deleted': 1, 'name': 1}", unique = true),
    @CompoundIndex(name = "pipeline_tenant_default_idx", def = "{'tenant_id': 1, 'deleted': 1, 'is_default': 1}")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Pipeline extends BaseEntity {

    @Field("name")
    private String name;

    @Field("is_default")
    private Boolean isDefault = false;

    @Field("currency")
    private String currency = "INR";
}
