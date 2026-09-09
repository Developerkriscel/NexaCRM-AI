package com.nexacrm.dto;

import lombok.*;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class PageResponse<T> {
    private List<T> content;
    private int page;
    private int size;
    private long total;
    private int totalPages;
    private boolean first;
    private boolean last;
}
