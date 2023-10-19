importScripts("https://cdn.jsdelivr.net/pyodide/v0.23.4/pyc/pyodide.js");

function sendPatch(patch, buffers, msg_id) {
  self.postMessage({
    type: 'patch',
    patch: patch,
    buffers: buffers
  })
}

async function startApplication() {
  console.log("Loading pyodide!");
  self.postMessage({type: 'status', msg: 'Loading pyodide'})
  self.pyodide = await loadPyodide();
  self.pyodide.globals.set("sendPatch", sendPatch);
  console.log("Loaded!");
  await self.pyodide.loadPackage("micropip");
  const env_spec = ['https://cdn.holoviz.org/panel/1.2.3/dist/wheels/bokeh-3.2.2-py3-none-any.whl', 'https://cdn.holoviz.org/panel/1.2.3/dist/wheels/panel-1.2.3-py3-none-any.whl', 'pyodide-http==0.2.1', 'cryptography', 'geopandas', 'hvplot', 'numpy', 'pandas', 'requests']
  for (const pkg of env_spec) {
    let pkg_name;
    if (pkg.endsWith('.whl')) {
      pkg_name = pkg.split('/').slice(-1)[0].split('-')[0]
    } else {
      pkg_name = pkg
    }
    self.postMessage({type: 'status', msg: `Installing ${pkg_name}`})
    try {
      await self.pyodide.runPythonAsync(`
        import micropip
        await micropip.install('${pkg}');
      `);
    } catch(e) {
      console.log(e)
      self.postMessage({
	type: 'status',
	msg: `Error while installing ${pkg_name}`
      });
    }
  }
  console.log("Packages loaded!");
  self.postMessage({type: 'status', msg: 'Executing code'})
  const code = `
  
import asyncio

from panel.io.pyodide import init_doc, write_doc

init_doc()

import panel as pn
import hvplot.pandas

from numpy import mean
import pandas as pd
import geopandas as gp
import base64
import io
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
from bokeh.models import GeoJSONDataSource, HoverTool, ColorBar
from bokeh.palettes import brewer
from bokeh.plotting import figure
from bokeh.transform import linear_cmap
import requests

def decrypt_file(password):
    """
    Decrypt a given file using a provided password.
    
    Args:
        file_name (str): Path to the encrypted file.
        password (str): Password for decryption.
        
    Returns:
        pd.DataFrame: Decrypted data as a pandas DataFrame.
    """
    
    url = "http://javier.science/panel_sicss_results/data/eval_data_cleaned.tsv.crypt"
    response = requests.get(url)
    file_data = response.content

    # Extract the salt and encrypted data
    salt, encrypted_data = file_data[:16], file_data[16:]

    # Key derivation
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
        backend=default_backend()
    )
    key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
    cipher_suite = Fernet(key)

    # Decrypting the data
    decrypted_data = cipher_suite.decrypt(encrypted_data)
    return pd.read_csv(io.StringIO(decrypted_data.decode('utf-8')))


def create_data(pass_):
    """
    Create dataframes for visualization and analysis.
    
    Args:
        pass_ (str): Password for decrypting the data file.
        
    Returns:
        tuple: df (aggregated data) and df_gemeente (to be visualized).
    """
    df = decrypt_file(pass_).drop_duplicates()
    
    # Filter for full population
    df["Full population"] = (
        (df["Gender"] == "All") &
        (df["Age"] == "All") &
        (df["Previous children"] == "All") &
        (df["Background"] == "All") &
        (df["Education"] == "All")
    )
    
    # Data to be visualized
    df_gemeente = df[df["Gemeente"] != "All"]
    df_gemeente["statcode"] = (
        "GM" + df_gemeente["Gemeente"].astype(float).astype(int).astype(str).str.zfill(4)
    )  # same as geopandas file
    df_g = gp.read_file("http://javier.science/panel_sicss_results/data/nld.geojson")
    df_g["geometry"] = df_g["geometry"]
    df_gemeente = pd.merge(df_g, df_gemeente)

    # Aggregated data
    df = df[df["Gemeente"] == "All"]
    
    # Additional filtering
    for var in {"Gender", "Age", "Previous children", "Background", "Education"}:
        df_gemeente[f"{var}_neg"] = True
        for var2 in {"Gender", "Age", "Previous children", "Background", "Education"} - {var}:
            df_gemeente.loc[df_gemeente[var2] != "All", f"{var}_neg"] = False
    df_gemeente["Full population_neg"] = True

    return df, df_gemeente


def plots(df, df_gemeente):
    """
    Create interactive plots using Panel and hvPlot.
    
    Args:
        df (pd.DataFrame): Aggregated data.
        df_gemeente (pd.DataFrame): Data to be visualized.
        
    Returns:
        pn.layout.Row: Layout for visualization.
    """
    # Define widgets for interactivity
    group_select = pn.widgets.Select(
        name='Grouping Variable',
        options=df_gemeente["group_name"].unique().tolist(),
        value="3_blinds"
    )
    group_var_select = pn.widgets.RadioBoxGroup(
        name='Grouping Variable',
        options=["Full population", "Gender", "Age", "Previous children", "Background", "Education"],
        value='Full population'
    )
    subgroup_select = pn.widgets.Select(
        name='Choose subgroup',
        options=df_gemeente[group_var_select.value].unique().tolist(),
        value='Full population'
    )
    
    # Update function for dynamic options in subgroup_select widget
    def update_subgroup(event):
        subgroup_select.options = df_gemeente[event.new].unique().tolist()
        subgroup_select.value = subgroup_select.options[0] if subgroup_select.options else None

    # Watch for changes in group_var_select value
    group_var_select.param.watch(update_subgroup, 'value')

    widgets = pn.Column(group_select, pn.Row(group_var_select, subgroup_select))
    
    # Define helper functions for plots

    def bounds(score):
        """Define the boundaries for colorbar in choropleth plot."""
        if len(score) == 0:
            return (0, 1)
        low = min(score[score > 0])
        high = max(score)
        mean_ = mean(score)
        range_ = min(mean_ - low, high - mean_)
        return (mean_ - range_, mean_ + range_)
    
    def plot_ch(group, grouping_variable, selection):
        """
        Create a choropleth plot for gemeenten based on the F1 score.
        
        Args:
            group (str): Selected group from the widget.
            grouping_variable (str): Selected grouping variable from the widget.
            selection (str): Subgroup selection from the widget.
            
        Returns:
            hvplot.plotting.core.Polygons: Choropleth plot.
        """
        # Filter the data based on user input
        df_gemeent1 = df_gemeente.loc[
            (df_gemeente["group_name"] == group) &
            (df_gemeente[grouping_variable] == selection) &
            (df_gemeente[f"{grouping_variable}_neg"] == True)
        ]

        # Determine the plot title
        if (selection == "All") or (grouping_variable == "Full population"):
            title = f"Prediction score (F1) in the different gemeenten of\\ngroup '{group}' for the full population"
        else:
            title = f"Prediction score (F1) in the different gemeenten of\\ngroup '{group}' for {grouping_variable} == {selection}"
        
        
        # Convert the merged data into GeoJSONDataSource for Bokeh
        geo_source = GeoJSONDataSource(geojson=df_gemeent1.to_json())
        low, high = bounds(df_gemeent1["f1_score"])
        # Create a mapper for coloring the data points on the map
        mapper = linear_cmap(field_name='f1_score', palette=brewer['RdYlBu'][8], low=low, high=high, nan_color="lightgray")
        

        # Create the figure and add the map using patches
        p = figure(title=title, tools='pan, wheel_zoom, reset, save')
        p.patches('xs', 'ys', source=geo_source, fill_color=mapper, line_color='black', line_width=0.5, fill_alpha=1)
        
        # Add hover functionality
        hover = HoverTool()
        hover.tooltips = [("Region", "@statnaam"), ("Code", "@statcode"), ("F1 score", "@f1_score")]
        p.add_tools(hover)
        
        # Add the ColorBar
        color_bar = ColorBar(color_mapper=mapper['transform'], width=8, location=(0,0))
        p.add_layout(color_bar, 'right')


        # Hide the axes
        p.xaxis.visible = False
        p.yaxis.visible = False
        p.xgrid.visible = False
        p.ygrid.visible = False
        
        return p
        
    def plot_s(group, grouping_variable):
        """
        Create a scatter plot of Recall vs Precision.
        
        Args:
            group (str): Selected group from the widget.
            grouping_variable (str): Selected grouping variable from the widget.
            
        Returns:
            hvplot.plotting.core.Scatter: Scatter plot.
        """
        df_agg = df.copy()
        tot_vars = {"Gender", "Age", "Previous children", "Background", "Education"} - {grouping_variable}

        # Aggregate data based on selected grouping variable
        for var in tot_vars:
            df_agg = df_agg[df_agg[var] == "All"]

        symbols = dict(zip(df[grouping_variable].unique(), ["s", "^", "o", "d", 'P', "X"]))

        # Create scatter plot for all models excluding the selected group
        sc = df_agg[df_agg["group_name"] != group].hvplot.scatter(
            y='precision',
            x='recall',
            by=grouping_variable,
            hover_cols=["group_name", "Gender", "Age", "Previous children", "Background", "Education"],
            title=f"Recall vs Precision for all models, grouped by {grouping_variable}"
        )

        # Highlight the selected group in the scatter plot
        sc_highlight = df_agg[df_agg["group_name"] == group].hvplot.scatter(
            y='precision',
            x='recall',
            color="k",
            marker="s",
            hover_cols=["group_name", "Gender", "Age", "Previous children", "Background", "Education"],
            legend=False
        )

        return sc * sc_highlight

    
    plot_ch_bound = pn.bind(plot_ch, group=group_select, grouping_variable=group_var_select, selection=subgroup_select)
    plot_s_bound = pn.bind(plot_s, group=group_select, grouping_variable=group_var_select)
    
    layout = pn.Row(pn.Column(widgets, pn.Spacer(height=20), plot_s_bound), plot_ch_bound)
    
    return layout


# Callback to execute when the password is submitted
def submit_password(event):
    """
    Callback function to handle password submission.
    
    Args:
        event: The triggering event (button click in this case).
    """
    password = pass_input.value
    
    # Switch to the Data View tab and show a loading message
    tabs.active = 1
    data_view.append(pn.pane.Markdown("Loading data"))
    
    # Use the password to create the necessary data
    df, df_gemeente = create_data(password)
    
    # Clear previous data views and display new data
    data_view.clear()
    data_view.append(plots(df, df_gemeente))

    try:
        # Get the entered password
        password = pass_input.value
        
        # Switch to the Data View tab and show a loading message
        tabs.active = 1
        data_view.append(pn.pane.Markdown("Loading data"))
        
        # Use the password to create the necessary data
        df, df_gemeente = create_data(password)
        
        # Clear previous data views and display new data
        data_view.clear()
        data_view.append(plots(df, df_gemeente))
        
    except Exception as e:
        # In case of any errors, switch back to the Stage 1 tab and display the error message
        tabs.active = 0
        error_message.object = f"Error: {str(e)}"


# Display introductory information
info = pn.pane.Markdown("""
# Welcome to the app.
Visualization of SICSS data 
""", width=500)

# Widget for password input
pass_input = pn.widgets.PasswordInput(name='Enter the password to decode the data', placeholder='Password here')

# Button to submit the password
button = pn.widgets.Button(name='Submit', button_type='primary')
button.on_click(submit_password)

# Create an error message pane (initially empty)
error_message = pn.pane.Markdown("", width=300)

# Define the layout for Stage 1
stage1 = pn.Column(info, pass_input, button, error_message, align="end")

# Create the data view pane (initially empty)
data_view = pn.Column(
    pn.pane.Markdown("")
)

# Tab layout to switch between Stage 1 and Data View
tabs = pn.Tabs(
    ("Stage 1", stage1),
    ("Data View", data_view)
)

tabs.servable()


await write_doc()
  `

  try {
    const [docs_json, render_items, root_ids] = await self.pyodide.runPythonAsync(code)
    self.postMessage({
      type: 'render',
      docs_json: docs_json,
      render_items: render_items,
      root_ids: root_ids
    })
  } catch(e) {
    const traceback = `${e}`
    const tblines = traceback.split('\n')
    self.postMessage({
      type: 'status',
      msg: tblines[tblines.length-2]
    });
    throw e
  }
}

self.onmessage = async (event) => {
  const msg = event.data
  if (msg.type === 'rendered') {
    self.pyodide.runPythonAsync(`
    from panel.io.state import state
    from panel.io.pyodide import _link_docs_worker

    _link_docs_worker(state.curdoc, sendPatch, setter='js')
    `)
  } else if (msg.type === 'patch') {
    self.pyodide.globals.set('patch', msg.patch)
    self.pyodide.runPythonAsync(`
    state.curdoc.apply_json_patch(patch.to_py(), setter='js')
    `)
    self.postMessage({type: 'idle'})
  } else if (msg.type === 'location') {
    self.pyodide.globals.set('location', msg.location)
    self.pyodide.runPythonAsync(`
    import json
    from panel.io.state import state
    from panel.util import edit_readonly
    if state.location:
        loc_data = json.loads(location)
        with edit_readonly(state.location):
            state.location.param.update({
                k: v for k, v in loc_data.items() if k in state.location.param
            })
    `)
  }
}

startApplication()