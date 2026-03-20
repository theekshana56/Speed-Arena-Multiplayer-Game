package com.speedarena.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class TestController {

    @GetMapping("/api/secure-test")
    public String secureTest() {
        return "JWT working ✅ You are authenticated!";
    }
}