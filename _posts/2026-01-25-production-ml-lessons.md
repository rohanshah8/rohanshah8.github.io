---
layout: post
title: "Lessons from Building Production ML Systems"
date: 2026-01-25
---

During my internship at Gojek, I worked on building a production-ready image moderation system. Here are the key lessons I learned about taking ML from research to production.

<!-- more -->

## Research vs Production

The gap between a research prototype and a production system is significant:

### Research Focus
- Maximizing accuracy metrics
- Clean, curated datasets
- Controlled environments
- Single model evaluation

### Production Reality
- Handling edge cases and noisy data
- Real-time performance requirements
- System reliability and monitoring
- Model versioning and updates

## Key Takeaways

### 1. Data Quality Matters More Than Model Complexity

Spending time on data cleaning, validation, and augmentation often yields better results than trying increasingly complex models.

### 2. Monitoring is Critical

You need to track:
- Model performance metrics over time
- Data drift detection
- System latency and throughput
- Error rates and failure modes

### 3. Start Simple

Begin with a simple baseline model and iterate. Don't over-engineer from the start.

### 4. Think About the Entire Pipeline

ML models are just one component. Consider:
- Data ingestion and preprocessing
- Feature engineering and storage
- Model serving infrastructure
- Feedback loops and retraining

## The Human Element

Remember that ML systems ultimately serve users. Always consider:
- User experience and latency
- Explainability and transparency
- Bias and fairness
- Privacy and security

Building production ML systems is as much about engineering discipline as it is about machine learning expertise.

Read more about my work at Gojek in [this Medium article](https://medium.com/the-algorithmic-minds/how-to-moderate-images-based-on-text-and-logo-using-ml-dl-f48a7ef173ac).
