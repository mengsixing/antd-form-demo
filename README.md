# antd-form-demo

antd-form底层使用rc-form进行表单操作，这里主要分析rc-form流程。

## 调用Form.create()(MyForm)

* 产生一个新容器组件Form，内置getFieldDecorator等属性和方法。
* 复制被包裹组件的静态属性到新组建中。
* 执行声明周期事件，主要是： getInitialState 初始化默认的field，这里默认无
* render函数返回原始组件（被注入了Form组件的属性）。

``` js
function createBaseForm(option = {}, mixins = []) {

    mixins = {
        getForm() {
            return {
                getFieldsValue: this.fieldsStore.getFieldsValue,
                setFieldsValue: this.setFieldsValue,
                getFieldDecorator: this.getFieldDecorator,
                validateFields: this.validateFields,
                // ...其他方法
            };
        }
    }
  
    return function decorate(WrappedComponent) {
    const Form = createReactClass({
        mixins,
        // 其他内置函数
        render() {
        const { wrappedComponentRef, ...restProps } = this.props;
        const formProps = {
            [formPropName]: this.getForm(), //从mixin引入的 在createDOMForm中
        };
        const props = mapProps.call(this, {
            ...formProps,
            ...restProps,
        });
        //把form属性挂在到WrappedComponent属性上
        return <WrappedComponent {...props} />;
        }
    });

    //复制包裹组件的静态属性到Form上
    return argumentContainer(Form, WrappedComponent);
    };
}

```

## 使用getFieldDecorator绑定表单项

* 创建表单信息到fieldsStore
* 绑定默认onChange事件
    * 触发验证
    * 保存结果到fieldsStore
* 返回双向数据绑定的input组件

``` js
{getFieldDecorator('userName', {
    rules: [{ required: true, message: 'Please input your username!' }],
    })(
    <Input prefix={<Icon type="user" style={{ color: 'rgba(0,0,0,.25)' }} />} placeholder="Username" />
)}
```

### 创建表单信息到fieldsStore,绑定默认onChange事件
``` js
getFieldDecorator(name, fieldOption) {
    //初始化store字段，绑定onChange事件
    const props = this.getFieldProps(name, fieldOption);
    //props: {value: "", ref: ƒ, onChange: ƒ}

    //接收传入input
    return (fieldElem) => {
        // 获取原有的表单项信息，如果没有就创建一个新的。
        const fieldMeta = this.fieldsStore.getFieldMeta(name);

        // 克隆传入的input组件，注入新属性，包括onChange，value等
        return React.cloneElement(fieldElem, {
        ...props,
        ...this.fieldsStore.getFieldValuePropValue(fieldMeta),// { value:'123' }
        });
    };
}

getFieldProps(name, usersFieldOption = {}) {
    const fieldOption = {
        name,// 自定义组件名称
        trigger: DEFAULT_TRIGGER,//默认绑定 onChange事件
        valuePropName: 'value', //默认值是value属性
        validate: [],
        ...usersFieldOption,
    };

    const {
        rules,
        trigger,
        validateTrigger = trigger,
        validate,
    } = fieldOption;

    const fieldMeta = this.fieldsStore.getFieldMeta(name);
    
    const inputProps = {
        ...this.fieldsStore.getFieldValuePropValue(fieldOption),
        ref: this.getCacheBind(name, `${name}__ref`, this.saveRef),
    };

    //转换成数组格式
    const validateRules = normalizeValidateRules(validate, rules, validateTrigger);
    //validateRules [{"trigger":["onChange"],"rules":[{"required":true,"message":"What's your name?"}]}]
    const validateTriggers = getValidateTriggers(validateRules);
    validateTriggers.forEach((action) => {
        if (inputProps[action]) return;
        //绑定事件
        inputProps[action] = this.getCacheBind(name, action, this.onCollectValidate);
    });

    //FieldMeta值
    const meta = {
        ...fieldMeta,
        ...fieldOption,
        validate: validateRules,
    };

    // 设置FieldMeta !!!
    this.fieldsStore.setFieldMeta(name, meta);

    return inputProps;
}
```




### 触发验证,保存结果到fieldsStore
``` js

onCollectValidate(name_, action, ...args) {
    const { field, fieldMeta } = this.onCollectCommon(name_, action, args);
    const newField = {
        ...field,
        dirty: true,  // 需要验证
    };
    
    // 验证
    this.validateFieldsInternal([newField], {
        action,
        options: {
        firstFields: !!fieldMeta.validateFirst,
        },
    });
}

onCollectCommon(name, action, args) {
    const fieldMeta = this.fieldsStore.getFieldMeta(name);

    // 执行表单的onChange事件
    if (fieldMeta[action]) {
        fieldMeta[action](...args);
    } else if (fieldMeta.originalProps && fieldMeta.originalProps[action]) {
        fieldMeta.originalProps[action](...args);
    }
    
    // 获取表单中的值，默认value
    const value = fieldMeta.getValueFromEvent ?
        fieldMeta.getValueFromEvent(...args) :
        getValueFromEvent(...args);

    const field = this.fieldsStore.getField(name);
    return ({ name, field: { ...field, value, touched: true }, fieldMeta });
}


validateFieldsInternal(fields, {fieldNames,action,options = {}}, callback) {
    const allRules = {};
    const allValues = {};
    const allFields = {};
    const alreadyErrors = {};
    fields.forEach((field) => {
        const name = field.name;
        // 不需要验证逻辑
        if (options.force !== true && field.dirty === false) {
        if (field.errors) {
            set(alreadyErrors, name, { errors: field.errors });
        }
            return;
        }

        const fieldMeta = this.fieldsStore.getFieldMeta(name);
        const newField = {
        ...field,
        };
        newField.errors = undefined;
        newField.validating = true; // 正在验证状态
        newField.dirty = true; // 表示需要验证
        allRules[name] = this.getRules(fieldMeta, action);
        allValues[name] = newField.value;
        allFields[name] = newField;
    });
    // {"name2":{"name":"name2","value":"","touched":true,"dirty":true,"validating":true}}
    this.setFields(allFields);

    Object.keys(allValues).forEach((f) => {
        allValues[f] = this.fieldsStore.getFieldValue(f);
    });
    
    // 初始化验证，使用async-validator库
    const validator = new AsyncValidator(allRules);
    if (validateMessages) {
        validator.messages(validateMessages);
    }
    //验证rule
    validator.validate(allValues, options, (errors) => {
        const errorsGroup = {
        ...alreadyErrors,
        };
        if (errors && errors.length) {
        errors.forEach((e) => {
            const fieldName = e.field;
            const field = get(errorsGroup, fieldName);
            if (typeof field !== 'object' || Array.isArray(field)) {
            set(errorsGroup, fieldName, { errors: [] });
            }
            const fieldErrors = get(errorsGroup, fieldName.concat('.errors'));
            fieldErrors.push(e);
        });
        }
        const nowAllFields = {};
        Object.keys(allRules).forEach((name) => {
        const fieldErrors = get(errorsGroup, name);
        const nowField = this.fieldsStore.getField(name);
        // 验证完成
        nowField.errors = fieldErrors && fieldErrors.errors;
        nowField.value = allValues[name];
        nowField.validating = false;
        nowField.dirty = false;
        nowAllFields[name] = nowField;
        });
        // {"name2":{"name":"name2","value":"","touched":true,"dirty":false,"errors":[{"message":"What's your name?","field":"name2"}],"validating":false}}
        this.setFields(nowAllFields);
        if (callback) {
        callback(isEmptyObject(errorsGroup) ? null : errorsGroup,
            this.fieldsStore.getFieldsValue(fieldNames));
        }
    });
}

```

## 设置值setFieldsValue

``` js

setFieldsValue(changedValues, callback) {
    const { fieldsMeta } = this.fieldsStore;
    // 过滤fieldsStore中没有的字段
    const values = this.fieldsStore.flattenRegisteredFields(changedValues);

    const newFields = Object.keys(values).reduce((acc, name) => {
        const isRegistered = fieldsMeta[name];
        if (isRegistered) {
        const value = values[name];
        acc[name] = {
            value,
        };
        }
        return acc;
    }, {});

    // 设置新值
    this.setFields(newFields, callback);
}


setFields(maybeNestedFields, callback) {
    const fields = this.fieldsStore.flattenRegisteredFields(maybeNestedFields);
    // 更新store中的值
    this.fieldsStore.setFields(fields);
    //react方法，强制更新组件
    this.forceUpdate(callback);
}

```


## 总结

Form内部有一套自己的状态管理：fieldsStore,上面记录着所有表单项的信息，通过getFieldDecorator和表单进行双向绑定。

![image](https://github.com/yhlben/antd-form-demo/blob/master/createform.png?raw=true)
