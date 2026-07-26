const { inferMetadataFromTags } = require('./question-metadata-backfill-map.v1.cjs');

function hasExplicitMetadata(row) {
    return Boolean(
        (row.subject && String(row.subject).trim()) ||
        (row.skill_code && String(row.skill_code).trim()) ||
        (row.subskill_code && String(row.subskill_code).trim()) ||
        row.difficulty !== null,
    );
}

function formatTagSignature(tags) {
    return tags
        .map((tag) => `#${tag}`)
        .sort((left, right) => left.localeCompare(right))
        .join(',');
}

function classifyReviewBucket(tags, inferred) {
    if (tags.includes('test_tag')) {
        return {
            reviewCategory: 'noise',
            reviewAction: 'cleanup_or_ignore',
        };
    }

    if (tags.includes('trang_nguyen')) {
        return {
            reviewCategory: 'mixed-signal-source-tag',
            reviewAction: 'sample_and_classify',
        };
    }

    if (tags.includes('gia_dinh')) {
        return {
            reviewCategory: 'theme-tag',
            reviewAction: 'theme_then_skill_review',
        };
    }

    if (inferred.subject && !inferred.skillCode) {
        return {
            reviewCategory: 'subject-only-gap',
            reviewAction: 'review_subject_then_assign_skill',
        };
    }

    return {
        reviewCategory: 'manual-review',
        reviewAction: 'manual_bucket_review',
    };
}

function buildPhase2ReviewRow(row) {
    if (hasExplicitMetadata(row)) {
        return null;
    }

    const inferred = inferMetadataFromTags(row.tags);
    if (inferred.tags.length === 0) {
        return null;
    }

    if (inferred.subject && inferred.skillCode) {
        return null;
    }

    const { reviewCategory, reviewAction } = classifyReviewBucket(inferred.tags, inferred);

    return {
        id: row.id,
        question: String(row.question || '').slice(0, 120),
        raw_tags: row.tags || '',
        tag_signature: formatTagSignature(inferred.tags),
        inferred_subject: inferred.subject || '',
        inferred_skill_code: inferred.skillCode || '',
        inferred_subskill_code: inferred.subskillCode || '',
        inferred_difficulty: inferred.difficulty || '',
        review_category: reviewCategory,
        review_action: reviewAction,
    };
}

module.exports = {
    buildPhase2ReviewRow,
};
