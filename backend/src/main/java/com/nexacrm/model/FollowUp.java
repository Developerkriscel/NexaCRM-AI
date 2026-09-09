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

@Document(collection = "follow_ups")
@CompoundIndexes({
    @CompoundIndex(name = "follow_up_tenant_lead_due_idx", def = "{'tenant_id': 1, 'lead_id': 1, 'deleted': 1, 'due_at': 1}"),
    @CompoundIndex(name = "follow_up_tenant_assigned_status_idx", def = "{'tenant_id': 1, 'assigned_to': 1, 'deleted': 1, 'status': 1, 'due_at': 1}")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FollowUp extends BaseEntity {

    @Field("lead_id")
    private String leadId;

    @Field("task_id")
    private String taskId;

    @Field("assigned_to")
    private String assignedToId;

    @Field("status")
    private String status = "PENDING";

    @Field("notes")
    private String notes;

    @Field("due_at")
    private LocalDateTime dueAt;

    @Field("completed_at")
    private LocalDateTime completedAt;
}
