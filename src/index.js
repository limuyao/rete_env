import Rete from "rete";
//import ConnectionPlugin from 'rete-connection-plugin'; // [error] t is undefined
import * as ConnectionPlugin from 'rete-connection-plugin'; // correct
import VueRenderPlugin from 'rete-vue-render-plugin';
import AreaPlugin from 'rete-area-plugin';

//import components
import VueNumControlSingle from '../components/VueNumControlSingle.vue';


let numSocket = new Rete.Socket('Number value');

let VueNumControl = {
    props: ['readonly', 'emitter', 'ikey', 'getData', 'putData'],
    template: '<input type="number" :readonly="readonly" :value="value" @input="change($event)" @dblclick.stop="" @pointermove.stop=""/>',
    data() {
        return {
            value: 0,
        }
    },
    methods: {
        change(e){
            this.value = +e.target.value;
            this.update();
        },
        update() {
            if (this.ikey)
                this.putData(this.ikey, this.value);
            this.emitter.trigger('process');
        }
    },
    mounted() {
        this.value = this.getData(this.ikey);
    }
};

class NumControl extends Rete.Control {

    constructor(emitter, key, readonly) {
        super(key);
        this.component = VueNumControlSingle; //instead of VueNumControl
        this.props = { emitter, ikey: key, readonly };
    }

    setValue(val) {
        this.vueContext.value = val;
    }
}

class NumComponent extends Rete.Component {

    constructor(){
        super("Number");
    }

    builder(node) {
        var out1 = new Rete.Output('num', "Number", numSocket);

        return node.addControl(new NumControl(this.editor, 'num')).addOutput(out1);
    }

    worker(node, inputs, outputs) {
        outputs['num'] = node.data.num;
    }
}

class AddComponent extends Rete.Component {
    constructor(){
        super("Add");
    }

    builder(node) {
        let inp1 = new Rete.Input('num1',"Number", numSocket);
        let inp2 = new Rete.Input('num2', "Number2", numSocket);
        let out = new Rete.Output('num', "Number", numSocket);

        inp1.addControl(new NumControl(this.editor, 'num1'));
        inp2.addControl(new NumControl(this.editor, 'num2'));

        return node
            .addInput(inp1)
            .addInput(inp2)
            .addControl(new NumControl(this.editor, 'preview', true))
            .addOutput(out);
    }

    worker(node, inputs, outputs) {
        let n1 = inputs['num1'].length?inputs['num1'][0]:node.data.num1;
        let n2 = inputs['num2'].length?inputs['num2'][0]:node.data.num2;
        let sum = n1 + n2;

        this.editor.nodes.find(n => n.id == node.id).controls.get('preview').setValue(sum);
        outputs['num'] = sum;
    }
}

(async () => {
    let container = document.querySelector('#rete');
    let components = [new NumComponent(), new AddComponent()];

    let editor = new Rete.NodeEditor('demo@0.1.0', container);
    editor.use(ConnectionPlugin.default);
    //editor.use(VueRenderPlugin.default); // delete .default
    editor.use(VueRenderPlugin); //correct

    //editor.use(ContextMenuPlugin.default);
    editor.use(AreaPlugin);
    //editor.use(CommentPlugin);
    //editor.use(HistoryPlugin);

    let engine = new Rete.Engine('demo@0.1.0');

    components.map(c => {
        editor.register(c);
        engine.register(c);
    });

    let n1 = await components[0].createNode({num: 2});
    let n2 = await components[0].createNode({num: 0});
    let add = await components[1].createNode();

    n1.position = [80, 200];
    n2.position = [80, 400];
    add.position = [500, 240];


    editor.addNode(n1);
    editor.addNode(n2);
    editor.addNode(add);

    editor.connect(n1.outputs.get('num'), add.inputs.get('num1'));
    editor.connect(n2.outputs.get('num'), add.inputs.get('num2'));


    editor.on('process nodecreated noderemoved connectioncreated connectionremoved', async () => {
        console.log('process');
        await engine.abort();
        await engine.process(editor.toJSON());
    });

    editor.view.resize();
    AreaPlugin.zoomAt(editor);
    editor.trigger('process');
})();