# 🚀 Bias Analysis API Performance Benchmark Report

**Generated:** 2025-09-15T22:52:15.518Z
**Test Duration:** 60 seconds
**Concurrent Users Tested:** 1, 5, 10, 25, 50

## 📊 Summary Statistics

- **Average Response Time:** 1004.78ms
- **Average Throughput:** 11.60 req/sec
- **Average Error Rate:** 1.74%
- **Total Requests:** 3800

## 🎯 Performance Targets

- **Target Response Time:** <2000ms
- **Target Throughput:** >10 req/sec
- **Target Error Rate:** <5.0%

## 📈 Detailed Results by Scenario

### Small Text Analysis

| Users | Avg Response | P95 Response | Throughput | Error Rate |
|-------|-------------|--------------|------------|------------|
| 1 | 1025ms | 1458ms | 0.9 | 2.0% |
| 5 | 986ms | 1460ms | 3.4 | 0.0% |
| 10 | 979ms | 1431ms | 6.7 | 2.0% |
| 25 | 1015ms | 1430ms | 15.9 | 1.2% |
| 50 | 988ms | 1426ms | 31.4 | 2.4% |

### Medium Text Analysis

| Users | Avg Response | P95 Response | Throughput | Error Rate |
|-------|-------------|--------------|------------|------------|
| 1 | 1042ms | 1433ms | 0.9 | 0.0% |
| 5 | 1010ms | 1451ms | 3.5 | 0.0% |
| 10 | 1026ms | 1443ms | 6.2 | 6.0% |
| 25 | 980ms | 1432ms | 15.9 | 1.6% |
| 50 | 987ms | 1431ms | 31.4 | 1.4% |

### Large Text Analysis

| Users | Avg Response | P95 Response | Throughput | Error Rate |
|-------|-------------|--------------|------------|------------|
| 1 | 1032ms | 1448ms | 0.9 | 0.0% |
| 5 | 1010ms | 1457ms | 3.5 | 0.0% |
| 10 | 1012ms | 1484ms | 6.6 | 0.0% |
| 25 | 985ms | 1437ms | 16.0 | 1.6% |
| 50 | 988ms | 1437ms | 31.2 | 2.2% |

### Complex Multi-Issue Analysis

| Users | Avg Response | P95 Response | Throughput | Error Rate |
|-------|-------------|--------------|------------|------------|
| 1 | 1013ms | 1432ms | 0.9 | 4.0% |
| 5 | 1001ms | 1484ms | 3.4 | 4.0% |
| 10 | 1031ms | 1451ms | 6.5 | 1.0% |
| 25 | 967ms | 1430ms | 15.9 | 2.4% |
| 50 | 1018ms | 1458ms | 30.8 | 3.0% |

## 💡 Recommendations

### ⚠️ Throughput Issues
Consider scaling for the following scenarios:
- Small Text Analysis (1 users): 0.9 req/sec
- Small Text Analysis (5 users): 3.4 req/sec
- Small Text Analysis (10 users): 6.7 req/sec
- Medium Text Analysis (1 users): 0.9 req/sec
- Medium Text Analysis (5 users): 3.5 req/sec
- Medium Text Analysis (10 users): 6.2 req/sec
- Large Text Analysis (1 users): 0.9 req/sec
- Large Text Analysis (5 users): 3.5 req/sec
- Large Text Analysis (10 users): 6.6 req/sec
- Complex Multi-Issue Analysis (1 users): 0.9 req/sec
- Complex Multi-Issue Analysis (5 users): 3.4 req/sec
- Complex Multi-Issue Analysis (10 users): 6.5 req/sec

### ❌ Error Rate Issues
Investigate errors in the following scenarios:
- Medium Text Analysis (10 users): 6.0%
