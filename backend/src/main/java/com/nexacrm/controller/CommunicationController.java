package com.nexacrm.controller;

import com.nexacrm.dto.ChannelSendRequest;
import com.nexacrm.dto.EmailSendRequest;
import com.nexacrm.dto.WhatsAppConversationResponse;
import com.nexacrm.dto.WhatsAppMessageResponse;
import com.nexacrm.service.CommunicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/communications")
@RequiredArgsConstructor
@Tag(name = "Communications", description = "Communication hub endpoints")
public class CommunicationController {

    private final CommunicationService communicationService;

    @PostMapping("/email/send")
    @PreAuthorize("hasAuthority('communications.send')")
    @Operation(summary = "Send an email via configured SMTP account")
    public ResponseEntity<Map<String, String>> sendEmail(@Valid @RequestBody EmailSendRequest request) {
        communicationService.sendEmail(request);
        return ResponseEntity.ok(Map.of("message", "Email sent successfully"));
    }

    @PostMapping("/send-channel")
    @PreAuthorize("hasAuthority('communications.send')")
    @Operation(summary = "Send a message over any configured channel")
    public ResponseEntity<Map<String, String>> sendChannel(@Valid @RequestBody ChannelSendRequest request) {
        communicationService.sendChannelMessage(
            request.getChannel(),
            request.getRecipient(),
            request.getSubject(),
            request.getBody()
        );
        return ResponseEntity.ok(Map.of("message", "Message sent successfully"));
    }

    @GetMapping("/whatsapp/messages")
    @PreAuthorize("hasAuthority('communications.read')")
    @Operation(summary = "Get WhatsApp messages by contact number")
    public ResponseEntity<List<WhatsAppMessageResponse>> getWhatsAppMessages(@RequestParam String contact) {
        return ResponseEntity.ok(communicationService.getWhatsAppMessages(contact));
    }

    @GetMapping("/whatsapp/conversations")
    @PreAuthorize("hasAuthority('communications.read')")
    @Operation(summary = "Get WhatsApp conversation summaries")
    public ResponseEntity<List<WhatsAppConversationResponse>> getWhatsAppConversations() {
        return ResponseEntity.ok(communicationService.getWhatsAppConversations());
    }

    @GetMapping("/facebook/conversations")
    @PreAuthorize("hasAuthority('communications.read')")
    @Operation(summary = "Get Facebook Messenger conversation summaries")
    public ResponseEntity<List<WhatsAppConversationResponse>> getFacebookConversations() {
        return ResponseEntity.ok(communicationService.getFacebookConversations());
    }

    @GetMapping("/facebook/messages")
    @PreAuthorize("hasAuthority('communications.read')")
    @Operation(summary = "Get Facebook Messenger messages by PSID")
    public ResponseEntity<List<WhatsAppMessageResponse>> getFacebookMessages(@RequestParam String psid) {
        return ResponseEntity.ok(communicationService.getFacebookMessages(psid));
    }

    @GetMapping("/instagram/conversations")
    @PreAuthorize("hasAuthority('communications.read')")
    @Operation(summary = "Get Instagram conversation summaries")
    public ResponseEntity<List<WhatsAppConversationResponse>> getInstagramConversations() {
        return ResponseEntity.ok(communicationService.getInstagramConversations());
    }

    @GetMapping("/instagram/messages")
    @PreAuthorize("hasAuthority('communications.read')")
    @Operation(summary = "Get Instagram messages by IGSID")
    public ResponseEntity<List<WhatsAppMessageResponse>> getInstagramMessages(@RequestParam String igsid) {
        return ResponseEntity.ok(communicationService.getInstagramMessages(igsid));
    }
}
