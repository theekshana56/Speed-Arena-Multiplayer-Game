package com.speedarena.repository;

import com.speedarena.model.LB_GameResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LB_GameResultRepository extends JpaRepository<LB_GameResult, Long> {

    // Return top 10 players sorted by total_time ASC
    List<LB_GameResult> findTop10ByOrderByTotalTimeAsc();
}
