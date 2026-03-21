package com.speedarena.repository;

import com.speedarena.model.Player;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PlayerRepository extends JpaRepository<Player, Long> {
    List<Player> findByRoomId(Long roomId);
    List<Player> findByRoomCode(String roomCode);
    Optional<Player> findByUserIdAndRoomId(Long userId, Long roomId);
    Optional<Player> findByUserIdAndRoomCode(Long userId, String roomCode);
    void deleteByRoomId(Long roomId);
    void deleteByRoomCode(String roomCode);
    boolean existsByUserIdAndRoomCode(Long userId, String roomCode);
}
