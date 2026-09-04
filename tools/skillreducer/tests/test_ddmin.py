from skillreducer.stage1.ddmin import ddmin


def test_ddmin_finds_minimal_subset() -> None:
    units = ["alpha", "beta", "gamma"]

    def oracle(candidate: list[str]) -> bool:
        return "alpha" in candidate and "gamma" in candidate

    result = ddmin(units, oracle)
    assert set(result) == {"alpha", "gamma"}
