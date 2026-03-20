package com.speedarena.repository;

import com.speedarena.model.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RoomRepository extends JpaRepository<Room, Long> {

    Room findByRoomCodeIgnoreCase(String roomCode);

    @Query("SELECT r FROM Room r LEFT JOIN FETCH r.players WHERE UPPER(r.roomCode) = UPPER(:code)")
    Room findWithPlayers(@Param("code") String code);
}