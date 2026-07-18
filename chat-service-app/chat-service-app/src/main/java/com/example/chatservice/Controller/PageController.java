package com.example.chatservice.Controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class PageController {

    @GetMapping(value = { "/", "/login", "/signup", "/register", "/chat" })
    public String forwardToSpa() {
        return "forward:/index.html";
    }
}
