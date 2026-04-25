package com.uit.cinema.booking.controller;

import com.uit.cinema.booking.entity.Voucher;
import com.uit.cinema.booking.repository.VoucherRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/vouchers")
@RequiredArgsConstructor
public class VoucherController {

    private final VoucherRepository voucherRepository;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<Voucher>> getAllVouchers() {
        return ResponseEntity.ok(voucherRepository.findAll());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Voucher> createVoucher(@RequestBody Voucher voucher) {
        return ResponseEntity.ok(voucherRepository.save(voucher));
    }

    @GetMapping("/validate/{code}")
    public ResponseEntity<Voucher> validateVoucher(@PathVariable String code) {
        return voucherRepository.findByCodeAndActiveTrue(code)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }
}
