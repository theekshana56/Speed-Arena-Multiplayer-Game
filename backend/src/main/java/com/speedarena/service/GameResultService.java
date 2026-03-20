package com.speedarena.service;

import com.speedarena.model.LB_GameResult;
import com.speedarena.repository.LB_GameResultRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class GameResultService {

    private final LB_GameResultRepository gameResultRepository;

    @Autowired
    public GameResultService(LB_GameResultRepository gameResultRepository) {
        this.gameResultRepository = gameResultRepository;
    }

    public LB_GameResult saveGameResult(LB_GameResult gameResult) {
        return gameResultRepository.save(gameResult);
    }

    public List<LB_GameResult> getTop10Leaderboard() {
        return gameResultRepository.findTop10ByOrderByTotalTimeAsc();
    }
}
