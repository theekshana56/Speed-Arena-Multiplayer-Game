package com.speedarena.service;

import com.speedarena.dto.RoomResponse;
import com.speedarena.model.Player;
import com.speedarena.model.Room;
import com.speedarena.repository.PlayerRepository;
import com.speedarena.repository.RoomRepository;
import com.speedarena.util.RoomCodeGenerator;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class RoomService {

    private final RoomRepository roomRepository;
    private final PlayerRepository playerRepository;

    public RoomService(RoomRepository roomRepository, PlayerRepository playerRepository) {
        this.roomRepository = roomRepository;
        this.playerRepository = playerRepository;
    }

    /**
     * Creates a new room and adds the creator as the host.
     */
    @Transactional
    public RoomResponse createRoom(Long userId, String username) {
        // Generate unique room code
        String roomCode = generateUniqueRoomCode();

        // Create room
        Room room = new Room(roomCode, userId, username);
        room = roomRepository.save(room);

        // Add host as first player
        Player hostPlayer = new Player(userId, username, room.getId(), roomCode, true);
        playerRepository.save(hostPlayer);

        return buildRoomResponse(room);
    }

    /**
     * Joins an existing room.
     */
    @Transactional
    public RoomResponse joinRoom(String roomCode, Long userId, String username) {
        Room room = roomRepository.findByRoomCode(roomCode.toUpperCase())
                .orElseThrow(() -> new RuntimeException("Room not found: " + roomCode));

        // Check if room is full
        if (room.getCurrentPlayers() >= room.getMaxPlayers()) {
            throw new RuntimeException("Room is full");
        }

        // Check if already in room
        if (playerRepository.existsByUserIdAndRoomCode(userId, roomCode)) {
            throw new RuntimeException("Already in this room");
        }

        // Check room status
        if (!"WAITING".equals(room.getStatus())) {
            throw new RuntimeException("Room is not accepting players");
        }

        // Add player to room
        Player player = new Player(userId, username, room.getId(), roomCode, false);
        playerRepository.save(player);

        // Update player count
        room.setCurrentPlayers(room.getCurrentPlayers() + 1);
        roomRepository.save(room);

        return buildRoomResponse(room);
    }

    /**
     * Gets room information by code.
     */
    public RoomResponse getRoom(String roomCode) {
        Room room = roomRepository.findByRoomCode(roomCode.toUpperCase())
                .orElseThrow(() -> new RuntimeException("Room not found: " + roomCode));
        return buildRoomResponse(room);
    }

    /**
     * Leaves a room.
     */
    @Transactional
    public void leaveRoom(String roomCode, Long userId) {
        Room room = roomRepository.findByRoomCode(roomCode.toUpperCase())
                .orElseThrow(() -> new RuntimeException("Room not found"));

        playerRepository.findByUserIdAndRoomCode(userId, roomCode)
                .ifPresent(player -> {
                    playerRepository.delete(player);
                    room.setCurrentPlayers(room.getCurrentPlayers() - 1);

                    // If host leaves and there are other players, transfer host
                    if (player.getIsHost() && room.getCurrentPlayers() > 0) {
                        List<Player> remainingPlayers = playerRepository.findByRoomCode(roomCode);
                        if (!remainingPlayers.isEmpty()) {
                            Player newHost = remainingPlayers.get(0);
                            newHost.setIsHost(true);
                            room.setHostId(newHost.getUserId());
                            room.setHostUsername(newHost.getUsername());
                            playerRepository.save(newHost);
                        }
                    }

                    // Delete room if empty
                    if (room.getCurrentPlayers() <= 0) {
                        roomRepository.delete(room);
                    } else {
                        roomRepository.save(room);
                    }
                });
    }

    /**
     * Sets player ready status.
     */
    @Transactional
    public void setPlayerReady(String roomCode, Long userId, boolean ready) {
        Player player = playerRepository.findByUserIdAndRoomCode(userId, roomCode)
                .orElseThrow(() -> new RuntimeException("Player not found in room"));
        player.setIsReady(ready);
        playerRepository.save(player);
    }

    /**
     * Starts the game (host only).
     */
    @Transactional
    public void startGame(String roomCode, Long userId) {
        Room room = roomRepository.findByRoomCode(roomCode.toUpperCase())
                .orElseThrow(() -> new RuntimeException("Room not found"));

        if (!room.getHostId().equals(userId)) {
            throw new RuntimeException("Only host can start the game");
        }

        room.setStatus("RACING");
        roomRepository.save(room);
    }

    /**
     * Builds room response with player list.
     */
    private RoomResponse buildRoomResponse(Room room) {
        RoomResponse response = new RoomResponse(room);

        List<Player> players = playerRepository.findByRoomCode(room.getRoomCode());
        List<RoomResponse.PlayerInfo> playerInfos = players.stream()
                .map(p -> new RoomResponse.PlayerInfo(
                        p.getUserId(),
                        p.getUsername(),
                        p.getCarColor(),
                        p.getIsReady(),
                        p.getIsHost()
                ))
                .collect(Collectors.toList());

        response.setPlayers(playerInfos);
        return response;
    }

    /**
     * Generates a unique 4-character room code.
     */
    private String generateUniqueRoomCode() {
        String code;
        int attempts = 0;
        do {
            code = RoomCodeGenerator.generate();
            attempts++;
            if (attempts > 100) {
                throw new RuntimeException("Could not generate unique room code");
            }
        } while (roomRepository.existsByRoomCode(code));
        return code;
    }
}
