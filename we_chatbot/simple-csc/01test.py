from lmcsc import LMCorrector
import torch

corrector = LMCorrector(
    model="Qwen/Qwen2.5-1.5B",
    prompted_model="Qwen/Qwen2.5-1.5B", # 建议 model 和 prompted_model 使用相同的模型以减少显存占用。
    config_path="configs/c2ec_config.yaml", # 你可以修改为 `default_config.yaml` 来禁用添字、删字操作。
    torch_dtype=torch.bfloat16, # 默认我们会使用 torch.float16 来进行计算。 但是我们发现在使用 Qwen2 或者 Qwen2.5 在没安装 flash-attn 的时候会导致运行时间过长。如果已经安装了 flash-attn 你可以不用专门设置这个参数。
)

outputs = corrector("加强设企收费监管是降低企业经营成本、优化营商环境的重要举措，对激发市场活力、促进经济社会高质量发展具有重要意义。为贯彻落实党中央、国务院决策部署，建立健全涉企收费长效监管机制，经国务院同意，现提出以下意见。")
print(outputs)