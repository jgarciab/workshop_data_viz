import marimo

__generated_with = "0.18.0"
app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo

    app = mo.App()
    return app, mo


@app.cell
def _():
    import numpy as np
    import pandas as pd
    from sklearn.ensemble import HistGradientBoostingRegressor
    import matplotlib.pyplot as plt

    # --- Data ---
    rng = np.random.default_rng(0)
    x = np.linspace(-5, 5, 500)
    y_true = 3 * x**3 + 5
    y = y_true + rng.normal(scale=50, size=x.shape)
    df = pd.DataFrame({"x": x, "y": y})

    return HistGradientBoostingRegressor, df, np, plt


@app.cell
def _(mo):
    lr = mo.ui.slider(
        start=0.001, stop=0.2, step=0.001, value=0.1,
        label="Learning rate"
    )
    lr
    return (lr,)


@app.cell
def _(HistGradientBoostingRegressor, df, lr, np, plt):
    model = HistGradientBoostingRegressor(learning_rate=lr.value)
    model.fit(df[["x"]], df["y"])

    x_grid = np.linspace(df.x.min(), df.x.max(), 200)
    y_pred = model.predict(x_grid.reshape(-1, 1))

    fig, ax = plt.subplots()
    ax.scatter(df.x, df.y, color="gray", s=10, alpha=0.5, label="data")
    ax.plot(x_grid, y_pred, color="blue", lw=3, label="ML fit")
    ax.set_xlabel("x")
    ax.set_ylabel("y")
    ax.legend()

    fig
    return


@app.cell
def _(app):
    if __name__ == "__main__":
        app.run()
    return


@app.cell
def _():
    return


if __name__ == "__main__":
    app.run()
