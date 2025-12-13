package com.chillspace.backend.repository;

import com.chillspace.backend.model.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface MessageRepository extends JpaRepository<Message, Long> {
    List<Message> findAllByOrderByTimestampAsc();

    // Update all messages from old username to new username
    @Modifying
    @Query("UPDATE Message m SET m.sender = :newUsername WHERE m.sender = :oldUsername")
    int updateSenderUsername(@Param("oldUsername") String oldUsername, @Param("newUsername") String newUsername);
}
