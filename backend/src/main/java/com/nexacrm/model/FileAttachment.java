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

@Document(collection = "files")
@CompoundIndexes({
    @CompoundIndex(name = "file_tenant_entity_idx", def = "{'tenant_id': 1, 'entity_type': 1, 'entity_id': 1, 'createdAt': -1}"),
    @CompoundIndex(name = "file_tenant_storage_idx", def = "{'tenant_id': 1, 'storage_provider': 1, 'storage_key': 1}", unique = true, partialFilter = "{ 'storage_key': { '$type': 'string', '$gt': '' } }")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FileAttachment extends BaseEntity {

    @Field("entity_type")
    private String entityType;

    @Field("entity_id")
    private String entityId;

    @Field("file_name")
    private String fileName;

    @Field("original_file_name")
    private String originalFileName;

    @Field("content_type")
    private String contentType;

    @Field("file_size")
    private Long fileSize;

    @Field("storage_provider")
    private String storageProvider;

    @Field("storage_key")
    private String storageKey;

    @Field("url")
    private String url;

    @Field("uploaded_by_id")
    private String uploadedById;

    @Field("checksum")
    private String checksum;
}
