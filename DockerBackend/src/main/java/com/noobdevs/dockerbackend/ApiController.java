package com.noobdevs.dockerbackend;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ApiController {

    private final MessageRepository repository;

    public ApiController(MessageRepository repository) {
        this.repository = repository;
    }

    // GET /api/health → {"status":"UP"}
    // A tiny endpoint the frontend can call to prove it can reach the backend.
    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "UP");
    }

    // GET /api/messages → all messages from MySQL
    @GetMapping("/messages")
    public List<Message> list() {
        return repository.findAll();
    }

    // POST /api/messages with body {"text": "..."} → saves and returns the new message
    @PostMapping("/messages")
    public Message create(@RequestBody Message message) {
        return repository.save(message);
    }
}
