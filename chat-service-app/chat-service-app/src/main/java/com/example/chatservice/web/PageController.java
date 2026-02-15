package com.example.chatservice.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class PageController {

    @GetMapping("/login")
    public String loginPage() {
        return "redirect:/index.html";
    }

    @GetMapping("/signup")
    public String signupPage() {
        return "redirect:/index.html";
    }

    @GetMapping("/chat")
    public String chatPage() {
        return "redirect:/chat.html";
    }
}
