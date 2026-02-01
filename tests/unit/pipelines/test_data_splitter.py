from ai.pipelines.orchestrator.data_splitter import DataSplitter


def test_split_ratios():
    # Create 100 dummy records
    data = [{"id": i, "content": f"record {i}"} for i in range(100)]

    splitter = DataSplitter(train_ratio=0.70, val_ratio=0.15, test_ratio=0.15)
    split = splitter.split(data, shuffle=False)

    assert len(split.train) == 70
    assert len(split.val) == 15
    assert len(split.test) == 15
    assert split.metadata["total_records"] == 100


def test_shuffle():
    data = [{"id": i} for i in range(100)]
    splitter = DataSplitter()

    # Split twice with same seed
    split1 = splitter.split(data.copy(), seed=42)
    split2 = splitter.split(data.copy(), seed=42)

    assert split1.train == split2.train

    # Split with different seed
    split3 = splitter.split(data.copy(), seed=43)
    assert split1.train != split3.train


def test_split_by_source():
    data = [
        {"id": 1, "source": "A"},
        {"id": 2, "source": "A"},
        {"id": 3, "source": "B"},
        {"id": 4, "source": "B"},
    ]
    splitter = DataSplitter(train_ratio=0.5, val_ratio=0.25, test_ratio=0.25)
    results = splitter.split_by_source(data)

    assert "A" in results
    assert "B" in results
    assert len(results["A"].train) == 1
    assert len(results["B"].train) == 1
