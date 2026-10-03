package com.noobdevs.dockerbackend;

import org.springframework.data.jpa.repository.JpaRepository;

// Spring Data generates the SQL for findAll(), save(), etc. at runtime.
public interface MessageRepository extends JpaRepository<Message, Long> {
}
