import React from 'react';
import ReactDOM from 'react-dom';
import { createForm } from 'rc-form';

class Form extends React.Component {
  constructor(){
    super();
    this.onSubmit=this.onSubmit.bind(this);
    this.onChange=this.onChange.bind(this);
  }
  componentWillMount() {
    //设置表单项名称，和规则
    this.nameDecorator = this.props.form.getFieldDecorator('name2', {
      initialValue: '',
      rules: [{
        required: true,
        message: 'What\'s your name?',
      }],
    });
  }

  onSubmit(e) {
    e.preventDefault();
    this.props.form.validateFields((error, values) => {
      if (!error) {
        console.log('ok', values);
      } else {
        console.log('error', error, values);
      }
    });
  };

  onChange(e) {
    console.log(e.target.value);
  }

  render() {
    const { getFieldError } = this.props.form;

    return (
      <form onSubmit={this.onSubmit}>
      
        {this.nameDecorator(
          <input
            onChange={this.onChange}
          />
        )}
        <div style={{ color: 'red' }}>
          {(getFieldError('name') || []).join(', ')}
        </div>
        <button>Submit</button>
      </form>
    );
  }
}

const WrappedForm = createForm()(Form);

export default WrappedForm;
