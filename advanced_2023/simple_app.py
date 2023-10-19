import panel as pn
import hvplot.pandas # make plot from pandas 
import pandas as pd

# Sample data
df = pd.DataFrame({
    'x': [1, 2, 3, 4, 5],
    'y': [5, 4, 2, 3, 1],
    'class': ["a", "b", "a", "b", "b"]
})

# Function that creates scatter plot based on point size
def create_scatter(size):
    return df.hvplot.scatter('x', 'y', size=size)

size_slider = pn.widgets.IntSlider(name='Point Size', start=5, end=200, step=5, value=50)
scatter_plot = pn.bind(create_scatter, size=size_slider)

# Combine scatter plot and widget in a layout
layout = pn.Column(size_slider, scatter_plot)

layout.servable()