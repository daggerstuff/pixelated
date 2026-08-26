Status: DONE Commit: 6395e7e7a6 Test:
tests/wandb/test_experiment_runner.py::test_exp_1_variation_is_epoch_only PASSED
(1 passed, 1 warning in 8.92s) Concerns: None. Config keys match exactly:
base_model, method, sft_epochs, rl_steps, data_path. Only sft_epochs varies (3
vs 5). No placeholders. No extra keys added. Files:
wandb/experiments/config_experiment_1.py (CONFIG_EXP_1_A/B + run_exp_1),
tests/wandb/test_experiment_runner.py (test_exp_1_variation_is_epoch_only)
