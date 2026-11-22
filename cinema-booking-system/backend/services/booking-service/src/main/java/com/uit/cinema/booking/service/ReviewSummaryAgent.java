package com.uit.cinema.booking.service;

import java.util.List;
import java.util.Optional;

public interface ReviewSummaryAgent {

    Optional<ReviewSummaryDraft> summarize(List<ReviewCommentSample> comments);
}
