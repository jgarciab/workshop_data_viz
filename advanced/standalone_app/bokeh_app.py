# Imports bokeh
from bokeh.io import show, output_notebook, output_file # others: push_notebook
from bokeh.models import ColumnDataSource, LogAxis, HoverTool, RangeTool, LogColorMapper, GeoJSONDataSource, LinearColorMapper, CategoricalColorMapper, Slider
from bokeh.layouts import row, column   # join plots
from bokeh.plotting import figure       # create figure
from bokeh.tile_providers import get_provider, WIKIMEDIA # for maps, others: CARTODBPOSITRON, STAMEN_TERRAIN, STAMEN_TONER, ESRI_IMAGERY, OSM
from bokeh.palettes import YlGnBu9 as YlGnBu,  YlOrBr9, YlOrBr4 # palettes
import panel as pn

from bokeh.sampledata.sea_surface_temperature import sea_surface_temperature

def bkapp():
    # read data and convert it to bokeh's data structure
    df = sea_surface_temperature.copy()
    source = ColumnDataSource(data=df)

    # make plot
    plot = figure(plot_width=650, 
                  plot_height=450,
                  x_axis_type='datetime', y_range=(0, 25),
                  y_axis_label='Temperature (Celsius)',
                  title="Sea Surface Temperature at 43.18, -70.43")
    # add line
    plot.line('time', 'temperature', source=source)

    # callback for reactivity
    def callback(attr, old, new):
        if new == 0:
            data = df
        else:
            data = df.rolling('{0}D'.format(new)).mean()
        source.data = ColumnDataSource.from_df(data)

    # somethign to interact with
    slider = Slider(start=0, end=30, value=0, step=1, title="Smoothing by N Days")
    slider.on_change('value', callback) # when to use callback

    return column(slider, plot)
    
# update plot
bokeh_app = pn.pane.Bokeh(bkapp()).servable()
