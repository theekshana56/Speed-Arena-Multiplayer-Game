package com.speedarena.service;

import com.speedarena.model.LB_GameResult;
import com.speedarena.repository.LB_GameResultRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class LB_GameResultService {

    private final LB_GameResultRepository repository;

    @Autowired
    public LB_GameResultService(LB_GameResultRepository repository) {
        this.repository = repository;
    }

    // Save Game Result
    public LB_GameResult saveGameResult(LB_GameResult result) {
        return repository.save(result);
    }

    // Get Leaderboard (Top 10 sorted by total_time ASC)
    public List<LB_GameResult> getLeaderboard() {
        return repository.findTop10ByOrderByTotalTimeAsc();
    }
}
