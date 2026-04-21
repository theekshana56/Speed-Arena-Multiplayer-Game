package com.speedarena.controller;

import com.speedarena.model.LB_GameResult;
import com.speedarena.service.LB_GameResultService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/results")
public class LB_GameResultController {

    private final LB_GameResultService service;

    @Autowired
    public LB_GameResultController(LB_GameResultService service) {
        this.service = service;
    }

    // Save Game Result
    @PostMapping("/save")
    public ResponseEntity<LB_GameResult> saveResult(@RequestBody LB_GameResult result) {
        System.out.println(">>> RECEIVING GAME RESULT");
        System.out.println(">>> Player ID: " + result.getPlayerId());
        System.out.println(">>> Player Name: " + result.getPlayerName());
        System.out.println(">>> Top Speed: " + result.getTopSpeed());
        System.out.println(">>> Total Time: " + result.getTotalTime());
        
        LB_GameResult savedResult = service.saveGameResult(result);
        System.out.println(">>> SAVED SUCCESSFUL. ID: " + savedResult.getId());
        return ResponseEntity.ok(savedResult);
    }


    // leadership board for top 10
    @GetMapping("/leaderboard")
    public ResponseEntity<List<LB_GameResult>> getLeaderboard() {
        List<LB_GameResult> leaderboard = service.getLeaderboard();
        return ResponseEntity.ok(leaderboard);
    }
}
