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

import java.util.Map;

@Document(collection = "audit_logs")
@CompoundIndexes({
    @CompoundIndex(name = "audit_tenant_created_idx", def = "{'tenant_id': 1, 'createdAt': -1}"),
    @CompoundIndex(name = "audit_tenant_entity_idx", def = "{'tenant_id': 1, 'entity_type': 1, 'entity_id': 1, 'createdAt': -1}"),
    @CompoundIndex(name = "audit_tenant_user_idx", def = "{'tenant_id': 1, 'user_id': 1, 'createdAt': -1}")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog extends BaseEntity {

    @Field("user_id")
    private String userId;

    @Field("action")
    private String action;

    @Field("entity_type")
    private String entityType;

    @Field("entity_id")
    private String entityId;

    @Field("old_values")
    private Map<String, Object> oldValues;

    @Field("new_values")
    private Map<String, Object> newValues;

    @Field("ip_address")
    private String ipAddress;

    @Field("user_agent")
    private String userAgent;
}
