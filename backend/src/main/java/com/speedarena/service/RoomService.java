package com.speedarena.service;

import com.speedarena.dto.RoomCreateRequest;
import com.speedarena.dto.RoomJoinRequest;
import com.speedarena.model.Room;
import com.speedarena.repository.RoomRepository;
import com.speedarena.util.RoomCodeGenerator;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class RoomService {

    private final RoomRepository roomRepository;

    @Autowired
    public RoomService(RoomRepository roomRepository) {
        this.roomRepository = roomRepository;
    }

    public Room createRoom(RoomCreateRequest request) {
        String roomCode = RoomCodeGenerator.generateCode();
        Room room = new Room(roomCode, request.getHostUsername(), request.getMaxPlayers());
        return roomRepository.save(room);
    }

    public Optional<Room> joinRoom(String roomCode, RoomJoinRequest request) {
        Optional<Room> roomOpt = roomRepository.findByRoomCode(roomCode);
        if (roomOpt.isPresent()) {
            Room room = roomOpt.get();
            if (room.getCurrentPlayers() < room.getMaxPlayers() && "WAITING".equals(room.getStatus())) {
                room.setCurrentPlayers(room.getCurrentPlayers() + 1);
                return Optional.of(roomRepository.save(room));
            }
        }
        return Optional.empty();
    }

    public Optional<Room> getRoomByCode(String roomCode) {
        return roomRepository.findByRoomCode(roomCode);
    }

    public List<Room> getAllActiveRooms() {
        return roomRepository.findAll();
    }

    public void updateRoomStatus(String roomCode, String status) {
        roomRepository.findByRoomCode(roomCode).ifPresent(room -> {
            room.setStatus(status);
            roomRepository.save(room);
        });
    }

    public void deleteRoom(String roomCode) {
        roomRepository.findByRoomCode(roomCode).ifPresent(room -> {
            roomRepository.delete(room);
        });
    }
}
