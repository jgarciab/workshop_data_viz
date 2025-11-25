# Run with panel serve panel_app.py --show


import panel as pn
import pandas as pd
import numpy as np
import hvplot.pandas
from sklearn.ensemble import HistGradientBoostingRegressor

pn.extension()

# --- Data ---
rng = np.random.default_rng(0)
x = np.linspace(-5, 5, 500)
y_true = 3 * x**3 + 5
y = y_true + rng.normal(scale=50, size=x.shape)
df = pd.DataFrame({"x": x, "y": y})

# --- Widget ---
lr = pn.widgets.FloatSlider(
    name="Learning rate",
    start=0.001, end=0.2, value=0.1, step=0.001
)

# --- Plot function ---
def fit_and_plot(learning_rate):
    model = HistGradientBoostingRegressor(learning_rate=learning_rate)
    model.fit(df[["x"]], df["y"])

    x_grid = np.linspace(df.x.min(), df.x.max(), 200)
    y_pred = model.predict(x_grid.reshape(-1, 1))
    df_pred = pd.DataFrame({"x": x_grid, "y": y_pred})

    return (
        df.hvplot.scatter(x="x", y="y", color="gray", alpha=0.5, size=5, legend=False)
        * df_pred.hvplot.line(x="x", y="y", color="blue", line_width=3)
    )

# Bind widget → function
plot = pn.bind(fit_and_plot, learning_rate=lr)

# --- Layout ---
pn.Column(
    "## Regression demo (HistGradientBoosting)",
    lr,
    plot,
).servable()
