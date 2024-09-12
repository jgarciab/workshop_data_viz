

bokeh_app.py contains the bokeh app embedded in panel (pn.pane.Bokeh(bkapp()).servable())
convert.sh contains the code (1 line) to convert the app to html/pyodide so it can be shown without a server handling the reactivity (your browser will act as your server)

You can then add the visualization to github pages and show it online. See the result [here](javier.science/workshop_data_viz_app/) and the resulting html files [here](https://github.com/jgarciab/workshop_data_viz_app).

