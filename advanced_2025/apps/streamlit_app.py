# streamlit_app.py
# run with streamlit run streamlit_app.py 
import streamlit as st
import pandas as pd
import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
import pylab as plt

# --- Data ---
rng = np.random.default_rng(0)
x = np.linspace(-5, 5, 500)
y_true = 3 * x**3 + 5
y = y_true + rng.normal(scale=50, size=x.shape)

df = pd.DataFrame({"x": x, "y": y})


st.title("Regression demo")

# --- Controls ---
learning_rate = st.slider(
    "Learning rate", 
    min_value=0.001, 
    max_value=0.2, 
    value=0.1, 
    step=0.001
)

# --- Fit model ---
X = x.reshape(-1, 1)
model = HistGradientBoostingRegressor(learning_rate=learning_rate)
model.fit(df["x"].values.reshape(-1,1), df["y"].values)

x_grid = np.linspace(x.min(), x.max(), 200)
y_pred = model.predict(x_grid.reshape(-1, 1))

# --- Plot ---
fig, ax = plt.subplots()
ax.scatter(x, y, label="data", color="gray")
ax.plot(x_grid, y_pred, label="ML fit", color="cornflowerblue", lw=3)
ax.set_xlabel("x")
ax.set_ylabel("y")
ax.legend()

st.pyplot(fig)
