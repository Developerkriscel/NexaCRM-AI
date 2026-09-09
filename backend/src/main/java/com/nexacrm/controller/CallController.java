package com.nexacrm.controller;

import com.nexacrm.service.CallAgentService;
import com.nexacrm.service.LeadService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/calls")
@RequiredArgsConstructor
@Tag(name = "Calls", description = "AI calling agent endpoints")
public class CallController {

    private final LeadService leadService;
    private final CallAgentService callAgentService;

    @PostMapping("/trigger/{leadId}")
    @PreAuthorize("hasAuthority('communications.send')")
    @Operation(summary = "Trigger outbound AI call for a lead")
    public ResponseEntity<Map<String, Object>> triggerLeadCall(
        @PathVariable String leadId,
        @RequestBody(required = false) Map<String, String> body
    ) {
        String script = body != null ? body.get("script") : null;
        return ResponseEntity.ok(leadService.callLeadNow(leadId, script));
    }

    @PostMapping("/webhook")
    @Operation(summary = "Receive voice-call provider webhook callbacks")
    public ResponseEntity<Map<String, Object>> processWebhook(
        @RequestBody Map<String, Object> payload,
        @RequestHeader(value = "X-Call-Agent-Secret", required = false) String secretHeader,
        @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        boolean authorized = callAgentService.isWebhookAuthorized(secretHeader, authorizationHeader, payload);
        if (!authorized) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("ok", false, "error", "Invalid webhook secret"));
        }
        return ResponseEntity.ok(callAgentService.processWebhook(payload));
    }

    @GetMapping("/{leadId}")
    @PreAuthorize("hasAuthority('leads.read')")
    @Operation(summary = "Get AI call history for one lead")
    public ResponseEntity<List<Map<String, Object>>> getLeadCalls(@PathVariable String leadId) {
        return ResponseEntity.ok(callAgentService.getLeadCallHistory(leadId));
    }

    @GetMapping("/{leadId}/intelligence")
    @PreAuthorize("hasAuthority('leads.read')")
    @Operation(summary = "Get AI call intelligence for one lead")
    public ResponseEntity<Map<String, Object>> getLeadCallIntelligence(@PathVariable String leadId) {
        return ResponseEntity.ok(callAgentService.getLeadCallIntelligence(leadId));
    }

    @PostMapping("/retry/{callId}")
    @PreAuthorize("hasAuthority('communications.send')")
    @Operation(summary = "Retry one previous call by call log id")
    public ResponseEntity<Map<String, Object>> retryCall(@PathVariable String callId) {
        return ResponseEntity.ok(callAgentService.retryCall(callId));
    }
}
